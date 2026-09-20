Pod::Spec.new do |s|
  s.name           = 'AppleVisionMatting'
  s.version        = '1.0.0'
  s.summary        = 'Apple Vision Native Foreground Matting for iOS 17+'
  s.description    = 'Native iOS 17+ Vision framework matting module for Expo using Apple Neural Engine'
  s.author         = ''
  s.homepage       = 'https://github.com'
  s.platforms      = { :ios => '17.0' }
  s.source         = { :path => '.' }
  s.source_files   = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision', 'CoreImage', 'UIKit', 'ImageIO'
end
