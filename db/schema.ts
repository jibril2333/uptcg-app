import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const decks = sqliteTable("decks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  seriesCode: text("series_code").notNull(),
  seriesName: text("series_name").notNull(),
  color: text("color").notNull().default(""),
  cardsJson: text("cards_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const collectionCards = sqliteTable("collection_cards", {
  cardKey: text("card_key").primaryKey(),
  cardJson: text("card_json").notNull(),
  count: integer("count").notNull(),
  updatedAt: text("updated_at").notNull(),
  workCode: text("work_code").notNull(),
  workName: text("work_name").notNull(),
});

export const pinnedSeries = sqliteTable("pinned_series", {
  code: text("code").primaryKey(),
  position: integer("position").notNull(),
});
