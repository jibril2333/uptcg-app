"use client";

import { useEffect } from "react";
import { loadCollection } from "../collection/collection-storage";
import { loadDecks } from "../decks/deck-storage";
import { loadPinnedCodes } from "./pinned-series-storage";

export function LegacyDataMigration({ seriesCodes }: { seriesCodes: string[] }) {
  useEffect(() => {
    void Promise.allSettled([
      loadDecks(),
      loadCollection(),
      loadPinnedCodes(new Set(seriesCodes), 10),
    ]);
  }, [seriesCodes]);

  return null;
}
