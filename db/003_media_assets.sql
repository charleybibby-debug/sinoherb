CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key TEXT NOT NULL UNIQUE,
  page_group TEXT NOT NULL,
  label TEXT NOT NULL,
  default_path TEXT NOT NULL DEFAULT '',
  file_path TEXT,
  alt_text TEXT NOT NULL DEFAULT '',
  mime_type TEXT,
  file_size INTEGER,
  backup_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS media_assets_page_group_idx ON media_assets (page_group, slot_key);

INSERT INTO media_assets (slot_key, page_group, label, default_path, alt_text)
VALUES
  ('home.hero', '首页', '首页主视觉', '', 'SinoHerb 首页主视觉'),
  ('home.wisdom.angelica', '首页', '当归草本卡片', '', '当归草本卡片'),
  ('home.wisdom.peony', '首页', '白芍草本卡片', '', '白芍草本卡片'),
  ('home.wisdom.motherwort', '首页', '益母草草本卡片', '', '益母草草本卡片'),
  ('home.wisdom.gardenia', '首页', '栀子花草本卡片', '', '栀子花草本卡片'),
  ('home.wisdom.poria', '首页', '茯苓草本卡片', '', '茯苓草本卡片'),
  ('home.wisdom.schisandra', '首页', '五味子草本卡片', '', '五味子草本卡片'),
  ('products.feature', '产品页', '产品页主推视觉', '', '产品页主推产品视觉'),
  ('constitution.chat', '体质检测页', '体质检测聊天引导图', '', '体质检测聊天引导图'),
  ('constitution.result', '体质检测页', '体质检测结果图', '', '体质检测结果图'),
  ('about.hero', '关于页', '关于我们主视觉', '', '关于我们主视觉'),
  ('philosophy.hero', '理念页', '理念页主视觉', '/assets/philosophy/hero-hybrid.svg', '传统智慧与现代生活'),
  ('philosophy.holistic-lifestyle', '理念页', '整体生活方式', '/assets/philosophy/holistic-lifestyle.svg', '整体生活方式'),
  ('philosophy.principle-holistic', '理念页', '整体观理念', '/assets/philosophy/principle-holistic.svg', '草本饮品与身体关系'),
  ('philosophy.principle-balance', '理念页', '平衡理念', '/assets/philosophy/principle-balance.svg', '阴阳动态轨道'),
  ('philosophy.principle-personalized', '理念页', '个性化理念', '/assets/philosophy/principle-personalized.svg', '个性化体质支持'),
  ('philosophy.principle-preventive', '理念页', '预防理念', '/assets/philosophy/principle-preventive.svg', '植物生长与持续调养'),
  ('philosophy.pattern-tension', '理念页', '紧绷模式', '/assets/philosophy/pattern-tension.svg', '思绪紧绷难以入睡'),
  ('philosophy.pattern-recovery', '理念页', '恢复模式', '/assets/philosophy/pattern-recovery.svg', '疲惫并且恢复不足'),
  ('philosophy.routine-sleep', '理念页', '睡眠日常', '/assets/philosophy/routine-sleep.svg', '安静睡眠场景'),
  ('philosophy.routine-pressure', '理念页', '压力日常', '/assets/philosophy/routine-pressure.svg', '放松呼吸场景'),
  ('philosophy.routine-digestive', '理念页', '消化日常', '/assets/philosophy/routine-digestive.svg', '草本饮品场景'),
  ('philosophy.routine-emotion', '理念页', '情绪日常', '/assets/philosophy/routine-emotion.svg', '户外散步场景'),
  ('philosophy.routine-experience', '理念页', '体验日常', '/assets/philosophy/routine-experience.svg', '草本体验与身体节律'),
  ('philosophy.modern-translation', '理念页', '现代翻译', '/assets/philosophy/modern-translation.svg', '传统理念的现代翻译')
ON CONFLICT (slot_key) DO UPDATE SET
  page_group = EXCLUDED.page_group,
  label = EXCLUDED.label,
  default_path = EXCLUDED.default_path,
  alt_text = EXCLUDED.alt_text,
  updated_at = NOW();

INSERT INTO media_assets (slot_key, page_group, label, default_path, alt_text)
SELECT 'product.' || slug || '.card', '产品页', name || '产品卡片', '', name || '产品卡片'
FROM products
ON CONFLICT (slot_key) DO NOTHING;

INSERT INTO media_assets (slot_key, page_group, label, default_path, alt_text)
SELECT 'product.' || slug || '.detail', '产品详情页', name || '详情主图', '', name || '详情主图'
FROM products
ON CONFLICT (slot_key) DO NOTHING;
