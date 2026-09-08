export type CardImageReference = {
  image: string;
  imageOfficialUrl?: string;
};

const officialCardImageRoot = "https://www.unionarena-tcg.com/jp/images/cardlist/card/";

export function cardImageUrl(card: CardImageReference) {
  return card.imageOfficialUrl || card.image;
}

export function officialCardImageUrl(fileName: string) {
  return `${officialCardImageRoot}${encodeURIComponent(fileName)}`;
}

export function exportableCardImageUrl(card: CardImageReference) {
  const source = cardImageUrl(card);
  if (!card.imageOfficialUrl) return source;
  return `/api/card-image?url=${encodeURIComponent(source)}`;
}
