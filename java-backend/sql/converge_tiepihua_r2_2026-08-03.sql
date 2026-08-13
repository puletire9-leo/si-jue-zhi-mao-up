-- 铁皮画 tiepihua 第二次收拢 R2  2026-08-03
-- 体检发现：3859 条里 2868（74%）仅靠类目召回，且类目 'Schilder' 作为独立词
-- 命中所有德语复合类目（Pflanzenschilder植物标签/Sicherheitsschilder安全牌/
-- Namensschilder名牌/Leuchtschilder灯箱/Hausnummern门牌）；另有 817 木牌 + 262 亚克力
-- 靠材质无关的 'Signs & Plaques' 类目漏入。铁皮画=金属/铁皮画牌，类目通道无法区分材质。
--
-- 策略：去掉类目召回，改金属锚定标题词；补排木质/亚克力/灯箱/门牌/安全牌/名牌等。
SET NAMES utf8mb4;

UPDATE nonstandard_carrier SET
  -- 金属锚定标题词（EN + DE），去掉泛类目
  title_keywords = CONCAT(
    'tin sign,metal sign,metal wall sign,metal wall art,metal plaque,metal tin sign,',
    'vintage tin sign,retro tin sign,vintage metal sign,funny metal sign,',
    'blechschild,metallschild,blechbild,metallbild,metall wandschild,',
    'vintage blechschild,retro blechschild,metall wandkunst,wandschild metall'),
  category_paths = '',
  -- 硬排除：非金属材质 + 功能性标牌（门牌/安全/名牌/灯箱/植物标签/交通）+ 已有旧词保留
  exclude_keywords = CONCAT(
    'wood,wooden,holz,acrylic,acryl,',
    'number plate,license plate,licence plate,nummernschild,kennzeichen,',
    'house number,hausnummer,turschild,türschild,door number,',
    'name badge,namensschild,namensschilder,werksausweis,',
    'safety sign,warning sign,sicherheitsschild,fire extinguisher,feuerloscher,feuerlöscher,',
    'no smoking,rauchen verboten,fluchtweg,piktogramm,',
    'led sign,neon sign,leuchtschild,light sign,3d letter light,leuchtbuchstaben,marry me,',
    'plant label,plant marker,pflanzenschild,pflanzenstecker,krauterschild,kräuterschild,herb marker,',
    'sticker,aufkleber,klebezahlen,',
    'guitar pick,pick holder,',
    'street sign traffic,road sign'),
  conditional_exclude_keywords = '',
  include_keywords = '',
  note = '2026-08-03 R2：金属锚定标题召回（去类目通道，类目无法区分材质）。排木质/亚克力/门牌/安全牌/名牌/灯箱/植物标签/贴纸/吉他拨片。木质归 woodsign。',
  updated_at = NOW()
WHERE carrier_key='tiepihua';
