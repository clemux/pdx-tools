use ck3save::models::{AliveData, Dynasty, DynastyHouse, LivingCharacter};
use ck3save::{
    models::Gamestate, models::HeaderOwned, models::PlayedCharacter, Ck3Error, Ck3File, Encoding,
    EnvTokens, FailedResolveStrategy,
};
use serde::Serialize;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

mod tokens;
pub use tokens::*;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ck3Metadata {
    version: String,
    is_meltable: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ck3Gamestate<'a> {
    version: String,
    played_character: &'a PlayedCharacter,
    // living: HashMap<u64, &'a LivingCharacter>,
    // houses: Vec<&'a DynastyHouse>,
    // houses: HashMap<u64, DynastyHouse>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ck3Character {
    first_name: String,
    house: u64,
}

pub struct SaveFileImpl {
    header: HeaderOwned,
    gamestate: Gamestate,
    encoding: Encoding,
}

pub fn to_json_value<T: serde::ser::Serialize + ?Sized>(value: &T) -> JsValue {
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    value.serialize(&serializer).unwrap()
}

#[wasm_bindgen]
pub struct SaveFile(SaveFileImpl);

#[wasm_bindgen]
impl SaveFile {
    pub fn metadata(&self) -> JsValue {
        to_json_value(&self.0.metadata())
    }

    pub fn gamestate(&self) -> JsValue {
        to_json_value(&self.0.gamestate())
    }

    pub fn get_character(&self, id: u64) -> JsValue {
        to_json_value(&self.0.get_character(id))
    }
}

impl SaveFileImpl {
    pub fn metadata(&self) -> Ck3Metadata {
        Ck3Metadata {
            version: self.header.meta_data.version.clone(),
            is_meltable: self.is_meltable(),
        }
    }

    pub fn gamestate(&self) -> Ck3Gamestate {
        Ck3Gamestate {
            version: self.gamestate.meta_data.version.clone(),
            played_character: &self.gamestate.played_character,
            // houses: self.gamestate.dynasties.dynasty_house,
        }
    }

    pub fn get_character(&self, id: u64) -> Ck3Character {
        match self.gamestate.living.get(&id) {
            Some(c) => Ck3Character {
                first_name: c.first_name.clone().unwrap(),
                house: c.dynasty_house.unwrap(),
            },
            None => panic!(),
        }
    }

    fn is_meltable(&self) -> bool {
        matches!(self.encoding, Encoding::Binary | Encoding::BinaryZip)
    }
}

fn _parse_save(data: &[u8]) -> Result<SaveFile, Ck3Error> {
    let file = Ck3File::from_slice(data)?;
    let mut zip_sink = Vec::new();
    let meta = file.parse(&mut zip_sink)?;
    let header = meta.deserializer(tokens::get_tokens()).deserialize()?;
    let gamestate: Gamestate = meta.deserializer(&EnvTokens).deserialize()?;
    Ok(SaveFile(SaveFileImpl {
        header,
        gamestate,
        encoding: file.encoding(),
    }))
}

#[wasm_bindgen]
pub fn parse_save(data: &[u8]) -> Result<SaveFile, JsValue> {
    let s = _parse_save(data).map_err(|e| JsValue::from_str(e.to_string().as_str()))?;
    Ok(s)
}

fn _melt(data: &[u8]) -> Result<ck3save::MeltedDocument, Ck3Error> {
    let file = Ck3File::from_slice(data)?;
    let mut zip_sink = Vec::new();
    let parsed_file = file.parse(&mut zip_sink)?;
    let binary = parsed_file.as_binary().unwrap();
    let out = binary
        .melter()
        .on_failed_resolve(FailedResolveStrategy::Ignore)
        .melt(tokens::get_tokens())?;
    Ok(out)
}

#[wasm_bindgen]
pub fn melt(data: &[u8]) -> Result<js_sys::Uint8Array, JsValue> {
    _melt(data)
        .map(|x| js_sys::Uint8Array::from(x.data()))
        .map_err(|e| JsValue::from_str(e.to_string().as_str()))
}
