use crate::remote_parse::remote_parse;
use clap::Args;
use std::{collections::HashMap, path::PathBuf, process::ExitCode};

/// Produces a tsv of most common habitable province letter
#[derive(Args)]
pub struct ProvinceNamesArgs {
    #[clap(value_parser)]
    file: PathBuf,
}

impl ProvinceNamesArgs {
    pub fn run(&self) -> anyhow::Result<ExitCode> {
        let (save, _encoding) = remote_parse(&self.file)?;
        let game = eu4game::game::Game::new(&save.meta.savegame_version);

        let mut characters: HashMap<_, usize> = HashMap::new();
        for (id, prov) in save.game.provinces.iter() {
            let Some(game_prov) = game.get_province(id) else {
                continue
            };

            if !game_prov.is_habitable() {
                continue;
            }

            let Some(c) = prov.name.chars().next() else {
                continue;
            };

            *characters.entry(c).or_default() += 1;
        }

        let mut list: Vec<_> = characters.iter().collect();
        list.sort_by_key(|(_, count)| *count);
        for (character, count) in list {
            println!("{}\t{}", character, count);
        }

        Ok(ExitCode::SUCCESS)
    }
}
