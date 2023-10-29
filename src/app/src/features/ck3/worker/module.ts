import { wasm } from "./common";
import {Character} from "@/features/ck3/worker/types";
export * from "./init";
export const melt = () => wasm.melt();

export function ck3GetCharacter(id: bigint): Character | null {
  const save = wasm.save;
  return save.get_character(id) as Character;
}

export function ck3GetCharacters(): Character[] {
  const save = wasm.save;
  return save.get_characters() as Character[];
}