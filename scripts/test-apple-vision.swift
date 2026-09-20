import Foundation
import Vision
import CoreImage
import AppKit

guard #available(macOS 14.0, iOS 17.0, *) else {
    print("Requires macOS 14.0+ / iOS 17.0+")
    exit(1)
}

let inputPath = "/private/tmp/cluttered_desk.jpg"
let outputPath = "/private/tmp/apple_vision_cutout.png"

guard let inputImage = CIImage(contentsOf: URL(fileURLWithPath: inputPath)) else {
    print("Failed to load input image from \(inputPath)")
    exit(1)
}

let startTime = CFAbsoluteTimeGetCurrent()

let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(ciImage: inputImage, options: [:])

do {
    try handler.perform([request])
    guard let result = request.results?.first else {
        print("No foreground detected")
        exit(1)
    }

    // Returns CVPixelBuffer
    let maskedPixelBuffer = try result.generateMaskedImage(
        ofInstances: result.allInstances,
        from: handler,
        croppedToInstancesExtent: false
    )

    let inferenceTime = (CFAbsoluteTimeGetCurrent() - startTime) * 1000
    print(String(format: "Apple Vision Neural Inference completed in: %.2f ms", inferenceTime))

    let ciMasked = CIImage(cvPixelBuffer: maskedPixelBuffer)
    let context = CIContext(options: nil)
    guard let cgImage = context.createCGImage(ciMasked, from: ciMasked.extent) else {
        print("Failed to create CGImage")
        exit(1)
    }

    let bitmapRep = NSBitmapImageRep(cgImage: cgImage)
    guard let pngData = bitmapRep.representation(using: .png, properties: [:]) else {
        print("Failed to encode PNG")
        exit(1)
    }

    try pngData.write(to: URL(fileURLWithPath: outputPath))
    let totalTime = (CFAbsoluteTimeGetCurrent() - startTime) * 1000
    print(String(format: "Saved \(outputPath) in total: %.2f ms", totalTime))

} catch {
    print("Error during Vision request: \(error)")
    exit(1)
}
