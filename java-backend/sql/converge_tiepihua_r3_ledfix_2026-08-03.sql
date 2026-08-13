-- 铁皮画 tiepihua R3：修 'led ' 子串误伤  2026-08-03
-- R2 排除词含裸 'led '，子串匹配误命中 pre-driLLED / patroLLED / roLLED edges 等正常铁皮牌（21条里20条误伤）。
-- 改为精确灯箱词：led sign / led light sign / light box sign（leuchtschild/leuchtbuchstaben 已在别处保留）。
SET NAMES utf8mb4;

UPDATE nonstandard_carrier SET
  exclude_keywords = CONCAT(
    'wood,wooden,holz,acrylic,acryl,',
    'number plate,license plate,licence plate,nummernschild,kennzeichen,',
    'house number,hausnummer,turschild,türschild,door number,',
    'name badge,namensschild,namensschilder,werksausweis,',
    'safety sign,warning sign,sicherheitsschild,fire extinguisher,feuerloscher,feuerlöscher,',
    'no smoking,rauchen verboten,fluchtweg,piktogramm,',
    'led sign,led light sign,light box sign,neon sign,leuchtschild,3d letter light,leuchtbuchstaben,marry me,',
    'plant label,plant marker,pflanzenschild,pflanzenstecker,krauterschild,kräuterschild,herb marker,',
    'sticker,aufkleber,klebezahlen,',
    'guitar pick,pick holder,',
    'street sign traffic,road sign'),
  note = '2026-08-03 R3：金属锚定标题召回（去类目通道）。R3 把裸 led  改为精确 led sign/light box sign，修 pre-drilled/rolled edges 误伤。木质归 woodsign。',
  updated_at = NOW()
WHERE carrier_key='tiepihua';
