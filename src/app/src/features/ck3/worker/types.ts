export interface Ck3Metadata {
  version: string;
  isMeltable: boolean;
}

export interface  Ck3Gamestate {
  version: string,
  playerCharacterId: bigint,
  houses: Array<Ck3DynastyHouse>
}

export interface  Ck3DynastyHouse {
  name: string,
  dynasty: number,
}

export interface Ck3SaveData {
  meta: Ck3Metadata
  gamestate: Ck3Gamestate
}

export interface Ck3PlayedCharacter {
  name: string,
  character: number
}

export interface Ck3AliveData {
  gold: number,
  health: number,
  income: number
}

export interface Character {
  id: number,
  firstName: string;
  houseId: number;
  houseName: string,
}
