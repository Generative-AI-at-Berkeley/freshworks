import { bufferContract } from './buffer.contract.js';
import { MemoryBuffer } from './memory-buffer.js';

bufferContract('MemoryBuffer', (maxBytes) => Promise.resolve(new MemoryBuffer(maxBytes)));
