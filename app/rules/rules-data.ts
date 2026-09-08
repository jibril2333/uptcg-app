import { officialCardImageUrl } from "../card-image";

export type RestrictedCard = {
  effectiveDate: string;
  fullCardNo: string;
  image: string;
  limit: 1 | 2;
  name: string;
  seriesCode: string;
  seriesName: string;
  shortCardNo: string;
};

export const restrictionUpdatedAt = "2026-03-24";
export const restrictionEffectiveDate = "2026-04-01";

export const restrictedCards: RestrictedCard[] = [
  {
    effectiveDate: restrictionEffectiveDate,
    fullCardNo: "UA44BT/EVA-1-051",
    image: officialCardImageUrl("UA44BT_EVA-1-051.png"),
    limit: 1,
    name: "式波・アスカ・ラングレー",
    seriesCode: "EVA",
    seriesName: "新世紀福音戰士",
    shortCardNo: "EVA-1-051",
  },
  {
    effectiveDate: restrictionEffectiveDate,
    fullCardNo: "UA44BT/EVA-1-063",
    image: officialCardImageUrl("UA44BT_EVA-1-063.png"),
    limit: 1,
    name: "ガイウスの槍",
    seriesCode: "EVA",
    seriesName: "新世紀福音戰士",
    shortCardNo: "EVA-1-063",
  },
  {
    effectiveDate: restrictionEffectiveDate,
    fullCardNo: "UA44BT/EVA-1-004",
    image: officialCardImageUrl("UA44BT_EVA-1-004.png"),
    limit: 1,
    name: "綾波 レイ",
    seriesCode: "EVA",
    seriesName: "新世紀福音戰士",
    shortCardNo: "EVA-1-004",
  },
  {
    effectiveDate: restrictionEffectiveDate,
    fullCardNo: "UA01BT/CGH-1-083",
    image: officialCardImageUrl("UA01BT_CGH-1-083.png"),
    limit: 1,
    name: "ナナリー・ランペルージ",
    seriesCode: "CGH",
    seriesName: "Code Geass 反叛的魯路修",
    shortCardNo: "CGH-1-083",
  },
  {
    effectiveDate: restrictionEffectiveDate,
    fullCardNo: "UA34BT/CGD-1-070",
    image: officialCardImageUrl("UA34BT_CGD-1-070.png"),
    limit: 1,
    name: "ファウルバウト",
    seriesCode: "CGD",
    seriesName: "Code Geass 奪回的 Rozé",
    shortCardNo: "CGD-1-070",
  },
  {
    effectiveDate: restrictionEffectiveDate,
    fullCardNo: "UA44BT/EVA-1-041",
    image: officialCardImageUrl("UA44BT_EVA-1-041.png"),
    limit: 2,
    name: "エヴァンゲリオン改2号機",
    seriesCode: "EVA",
    seriesName: "新世紀福音戰士",
    shortCardNo: "EVA-1-041",
  },
];

export const liftedRestrictions = [
  {
    cardNo: "SAO-2-029",
    effectiveDate: restrictionEffectiveDate,
    name: "ユナ",
    seriesName: "刀劍神域",
  },
];
