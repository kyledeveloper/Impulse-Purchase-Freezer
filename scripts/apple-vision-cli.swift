import Foundation
import Vision
import CoreImage
import AppKit

guard #available(macOS 14.0, iOS 17.0, *) else {
    fputs("Error: macOS 14.0+ required for VNGenerateForegroundInstanceMaskRequest\n", stderr)
    exit(1)
}

let args = CommandLine.arguments
if args.count < 3 {
    fputs("Usage: apple-vision-cli <inputImagePath> <outputPngPath>\n", stderr)
    exit(1)
}

let inputPath = args[1]
let outputPath = args[2]

guard let inputImage = CIImage(contentsOf: URL(fileURLWithPath: inputPath)) else {
    fputs("Error: Could not load input image at \(inputPath)\n", stderr)
    exit(2)
}

let startTime = CFAbsoluteTimeGetCurrent()
let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(ciImage: inputImage, options: [:])

do {
    try handler.perform([request])
    guard let result = request.results?.first else {
        fputs("Warning: No foreground detected, falling back to original\n", stderr)
        exit(3)
    }

    let maskedPixelBuffer = try result.generateMaskedImage(
        ofInstances: result.allInstances,
        from: handler,
        croppedToInstancesExtent: false
    )

    let ciMasked = CIImage(cvPixelBuffer: maskedPixelBuffer)
    let context = CIContext(options: nil)
    guard let cgImage = context.createCGImage(ciMasked, from: ciMasked.extent) else {
        fputs("Error: Failed to create CGImage from masked buffer\n", stderr)
        exit(4)
    }

    let bitmapRep = NSBitmapImageRep(cgImage: cgImage)
    guard let pngData = bitmapRep.representation(using: .png, properties: [:]) else {
        fputs("Error: Failed to encode PNG\n", stderr)
        exit(5)
    }

    try pngData.write(to: URL(fileURLWithPath: outputPath))
    let elapsedMs = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
    print(String(format: "SUCCESS:%.2f", elapsedMs))
    exit(0)
} catch {
    fputs("Error during Vision execution: \(error)\n", stderr)
    exit(6)
}
