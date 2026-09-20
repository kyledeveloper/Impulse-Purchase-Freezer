import ExpoModulesCore
import Vision
import CoreImage
import UIKit
import ImageIO

public class AppleVisionMattingModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleVisionMatting")

    AsyncFunction("removeBackground") { (imageUri: String, promise: Promise) in
      guard #available(iOS 17.0, *) else {
        promise.reject("ERR_UNSUPPORTED_OS", "Apple Vision Foreground Instance Mask requires iOS 17.0 or higher")
        return
      }

      DispatchQueue.global(qos: .userInitiated).async {
        do {
          guard let (cgImage, orientation) = self.loadImage(from: imageUri) else {
            promise.reject("ERR_LOAD_IMAGE", "Could not decode image at path: \(imageUri)")
            return
          }

          let cutoutCG = try self.performVisionMatting(cgImage: cgImage, orientation: orientation)
          let outputUI = UIImage(cgImage: cutoutCG)
          guard let pngData = outputUI.pngData() else {
            promise.reject("ERR_ENCODE_PNG", "Failed to encode cutout PNG")
            return
          }

          let tempDir = FileManager.default.temporaryDirectory
          let outputFile = tempDir.appendingPathComponent("vision_cutout_\(UUID().uuidString).png")
          try pngData.write(to: outputFile)

          promise.resolve(outputFile.absoluteString)
        } catch {
          promise.reject("ERR_VISION_FAILED", error.localizedDescription)
        }
      }
    }

    AsyncFunction("freezeInIceCube") { (imageUri: String, iceCubePath: String, promise: Promise) in
      guard #available(iOS 17.0, *) else {
        promise.reject("ERR_UNSUPPORTED_OS", "Apple Vision Foreground Instance Mask requires iOS 17.0 or higher")
        return
      }

      DispatchQueue.global(qos: .userInitiated).async {
        do {
          guard let (cgImage, orientation) = self.loadImage(from: imageUri) else {
            promise.reject("ERR_LOAD_IMAGE", "Could not decode image at path: \(imageUri)")
            return
          }

          let cutoutCG = try self.performVisionMatting(cgImage: cgImage, orientation: orientation)
          let cutoutUI = UIImage(cgImage: cutoutCG)
          guard let cutoutData = cutoutUI.pngData() else {
            promise.reject("ERR_ENCODE_PNG", "Failed to encode cutout PNG")
            return
          }

          let tempDir = FileManager.default.temporaryDirectory
          let cutoutFile = tempDir.appendingPathComponent("vision_cutout_\(UUID().uuidString).png")
          try cutoutData.write(to: cutoutFile)

          // Perform Ice Cube Compositing
          guard let iceCubeImage = self.loadImageDirect(from: iceCubePath) else {
            // If ice cube image failed to load, return cutout for both
            promise.resolve([
              "cutoutUri": cutoutFile.absoluteString,
              "frozenUri": cutoutFile.absoluteString
            ])
            return
          }

          let trimmedCG = self.trimTransparentPixels(cgImage: cutoutCG) ?? cutoutCG
          let frozenUI = self.compositeIntoIceCube(trimmedCG: trimmedCG, iceCubeImage: iceCubeImage)
          guard let frozenData = frozenUI.pngData() else {
            promise.resolve([
              "cutoutUri": cutoutFile.absoluteString,
              "frozenUri": cutoutFile.absoluteString
            ])
            return
          }

          let frozenFile = tempDir.appendingPathComponent("vision_frozen_\(UUID().uuidString).png")
          try frozenData.write(to: frozenFile)

          promise.resolve([
            "cutoutUri": cutoutFile.absoluteString,
            "frozenUri": frozenFile.absoluteString
          ])
        } catch {
          promise.reject("ERR_VISION_FAILED", error.localizedDescription)
        }
      }
    }
  }

  private func loadImage(from uri: String) -> (CGImage, CGImagePropertyOrientation)? {
    var inputURL: URL?
    if uri.hasPrefix("file://") {
      inputURL = URL(string: uri)
    } else if uri.hasPrefix("/") {
      inputURL = URL(fileURLWithPath: uri)
    } else if let url = URL(string: uri), url.scheme != nil {
      inputURL = url
    } else {
      inputURL = URL(fileURLWithPath: uri)
    }

    guard let fileURL = inputURL else { return nil }
    guard let uiImage = UIImage(contentsOfFile: fileURL.path) ?? (try? Data(contentsOf: fileURL)).flatMap({ UIImage(data: $0) }),
          let cgImage = uiImage.cgImage else {
      return nil
    }

    let orientation: CGImagePropertyOrientation
    switch uiImage.imageOrientation {
    case .up: orientation = .up
    case .upMirrored: orientation = .upMirrored
    case .down: orientation = .down
    case .downMirrored: orientation = .downMirrored
    case .left: orientation = .left
    case .leftMirrored: orientation = .leftMirrored
    case .right: orientation = .right
    case .rightMirrored: orientation = .rightMirrored
    @unknown default: orientation = .up
    }

    return (cgImage, orientation)
  }

  private func loadImageDirect(from uri: String) -> UIImage? {
    if uri.hasPrefix("file://") {
      if let url = URL(string: uri) {
        return UIImage(contentsOfFile: url.path)
      }
    }
    return UIImage(contentsOfFile: uri)
  }

  private func performVisionMatting(cgImage: CGImage, orientation: CGImagePropertyOrientation) throws -> CGImage {
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
    try handler.perform([request])

    guard let result = request.results?.first else {
      throw NSError(domain: "AppleVisionMatting", code: -1, userInfo: [NSLocalizedDescriptionKey: "No foreground detected"])
    }

    let maskedBuffer = try result.generateMaskedImage(
      ofInstances: result.allInstances,
      from: handler,
      croppedToInstancesExtent: false
    )

    let ciMasked = CIImage(cvPixelBuffer: maskedBuffer)
    let context = CIContext(options: nil)
    guard let outputCG = context.createCGImage(ciMasked, from: ciMasked.extent) else {
      throw NSError(domain: "AppleVisionMatting", code: -2, userInfo: [NSLocalizedDescriptionKey: "Failed to create output CGImage"])
    }

    return outputCG
  }

  private func trimTransparentPixels(cgImage: CGImage) -> CGImage? {
    guard let dataProvider = cgImage.dataProvider,
          let data = dataProvider.data,
          let ptr = CFDataGetBytePtr(data) else {
      return cgImage
    }
    let width = cgImage.width
    let height = cgImage.height
    let bytesPerRow = cgImage.bytesPerRow
    let bytesPerPixel = max(1, cgImage.bitsPerPixel / 8)

    var minX = width, maxX = 0, minY = height, maxY = 0
    var found = false

    for y in 0..<height {
      let rowOffset = y * bytesPerRow
      for x in 0..<width {
        let alpha = ptr[rowOffset + x * bytesPerPixel + (bytesPerPixel - 1)]
        if alpha > 15 {
          found = true
          if x < minX { minX = x }
          if x > maxX { maxX = x }
          if y < minY { minY = y }
          if y > maxY { maxY = y }
        }
      }
    }

    if !found || maxX <= minX || maxY <= minY {
      return cgImage
    }

    let cropRect = CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
    return cgImage.cropping(to: cropRect) ?? cgImage
  }

  private func compositeIntoIceCube(trimmedCG: CGImage, iceCubeImage: UIImage) -> UIImage {
    let cubeSize = iceCubeImage.size // e.g. 203x210
    let maxW: CGFloat = 105.0
    let maxH: CGFloat = 110.0

    let origW = CGFloat(trimmedCG.width)
    let origH = CGFloat(trimmedCG.height)
    let scale = min(maxW / origW, maxH / origH, 1.0)
    let targetW = origW * scale
    let targetH = origH * scale

    let targetX = 102.0 - (targetW / 2.0)
    let targetY = 96.0 - (targetH / 2.0)

    let renderer = UIGraphicsImageRenderer(size: cubeSize)
    return renderer.image { _ in
      // 1. Solid ice cube base
      iceCubeImage.draw(in: CGRect(origin: .zero, size: cubeSize))

      // 2. Cutout item centered in ice cavity
      let itemUI = UIImage(cgImage: trimmedCG)
      itemUI.draw(in: CGRect(x: targetX, y: targetY, width: targetW, height: targetH))

      // 3. Front ice sheen at 38% opacity (eliminates dark oval frame)
      iceCubeImage.draw(in: CGRect(origin: .zero, size: cubeSize), blendMode: .normal, alpha: 0.38)
    }
  }
}
