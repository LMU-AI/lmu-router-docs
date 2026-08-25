import { defineI18nUI } from 'fumadocs-ui/i18n';
import { i18n } from '@/lib/i18n';

// Fumadocs UI 的界面文案翻译 + RootProvider 用的 i18n provider。
// 英文是库的默认文案，只需给出 displayName；中文全量覆盖。
export const { provider } = defineI18nUI(i18n, {
  translations: {
    cn: {
      displayName: '简体中文',
      search: '搜索文档',
      searchNoResult: '没有找到相关内容',
      toc: '本页目录',
      tocNoHeadings: '本页暂无目录',
      lastUpdate: '最后更新',
      chooseLanguage: '选择语言',
      nextPage: '下一页',
      previousPage: '上一页',
      chooseTheme: '主题',
      editOnGithub: '在 GitHub 上编辑',
    },
    en: {
      displayName: 'English',
    },
  },
});
