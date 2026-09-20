import { pipeline } from '@huggingface/transformers';
import fs from 'fs';

async function run() {
  console.log('Loading pipeline for onnx-community/BiRefNet_lite-ONNX...');
  const segmenter = await pipeline('image-segmentation', 'onnx-community/BiRefNet_lite-ONNX', {
    device: 'cpu',
  });
  console.log('Pipeline loaded, running inference...');
  const t0 = Date.now();
  const output = await segmenter('/private/tmp/cluttered_desk.jpg');
  console.log('Inference done in', Date.now() - t0, 'ms');
  console.log('Output:', output);
  if (output && output[0] && output[0].mask) {
    // save mask
    await output[0].mask.save('/private/tmp/transformers_birefnet_mask.png');
    console.log('Saved mask to /private/tmp/transformers_birefnet_mask.png');
  }
}

run().catch(console.error);
