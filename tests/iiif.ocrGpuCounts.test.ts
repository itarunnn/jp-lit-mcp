import {afterEach,describe,expect,it} from "vitest";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {validateGpuCounts} from "../src/iiif/ocrGpu.js";
import {modalEngineHash} from "../src/iiif/ocrModalSchemas.js";

const dirs:string[]=[];afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
describe("GPU output stages",()=>{
  it("accepts the final reordered line count while preserving complete OCR batch counts",async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),"gpu-stage-counts-"));dirs.push(dir);
    await writeFile(path.join(dir,"gpu-validation.json"),JSON.stringify({status:"completed",expected_lines:42,returned_lines:42,ordered_input_lines:42,ordered_output_lines:23}));
    await expect(validateGpuCounts(dir,23)).resolves.toBeUndefined();
    await expect(validateGpuCounts(dir,22)).rejects.toThrow();
    await writeFile(path.join(dir,"gpu-validation.json"),JSON.stringify({status:"completed",expected_lines:42,returned_lines:41,ordered_input_lines:41,ordered_output_lines:23}));
    await expect(validateGpuCounts(dir,23)).rejects.toThrow();
  });
  it("keeps model identity stable across A10 hardware labels while preserving the image and code binding",()=>{
    const a={python_version:"3.10",torch_version:"2.1.1",cuda_version:"12.1",gpu:"NVIDIA A10G",files:[{path:"model.bin",sha256:"a".repeat(64)}]};
    expect(modalEngineHash("im-one",a)).toBe(modalEngineHash("im-one",{...a,gpu:"NVIDIA A10"}));
    expect(modalEngineHash("im-one",a)).not.toBe(modalEngineHash("im-two",a));
    expect(modalEngineHash("im-one",a)).not.toBe(modalEngineHash("im-one",{...a,files:[{path:"model.bin",sha256:"b".repeat(64)}]}));
  });
});
