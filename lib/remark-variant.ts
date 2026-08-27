// 分站定位文案的 remark 插件：正文里用 <CN>…</CN> / <Intl>…</Intl> 包住只在某个
// 变体成立的段落（典型：国内站的「国内直连免代理」 vs 海外站的「新加坡节点境外直连」）。
//   - com 构建：拆封 <CN>（保留其 children），删除 <Intl> 整块；
//   - ai  构建：反之。
//
// 为什么在 remark（mdast）阶段做：本插件跑在 fumadocs-mdx 的 remarkStructure
//（站内搜索索引）与 remarkPostprocess（getText('processed') → llms-full.txt）之前，
// 拆封/删除会一并传播到页面 HTML、搜索索引、llms 三处，不会出现「页面对了、
// 搜索还搜得到另一个变体的话术」。
//
// 标记名刻意用大写开头（CN / Intl）：如果本插件因故没处理掉，MDX 会把它们当
// 未定义的 JSX 组件、构建直接报错（响亮失败），而不是静默把小写标签漏进 HTML。
//
// 约束：不要用标记包住标题 —— remarkHeading 先于本插件分配 slug id，删掉同文标题
// 之一可能给幸存者留下 -1 后缀、断掉既有锚点。定位差异只写在正文/Callout 里。
//
// 注意：本文件被 source.config.ts 引用，而 source.config.ts 由 fumadocs-mdx 单独
// 打包 —— 只用相对路径 import，不用 '@/'（别名在那条打包链上不保证解析）。
import { visit, SKIP } from 'unist-util-visit';
import type { Node, Parent } from 'unist';
import { IS_AI } from './variant';

const KEEP = IS_AI ? 'Intl' : 'CN';
const DROP = IS_AI ? 'CN' : 'Intl';

interface MdxJsxNode extends Parent {
  name?: string | null;
}

export function remarkVariant() {
  return (tree: Node) => {
    visit(
      tree,
      ['mdxJsxFlowElement', 'mdxJsxTextElement'],
      (node: Node, index: number | undefined, parent: Parent | undefined) => {
        if (!parent || typeof index !== 'number') return;
        const name = (node as MdxJsxNode).name;
        if (name === DROP) {
          parent.children.splice(index, 1);
          // 从原位置继续访问（后面的兄弟节点已前移一位）。
          return [SKIP, index];
        }
        if (name === KEEP) {
          parent.children.splice(index, 1, ...(node as MdxJsxNode).children);
          // 从原位置继续 —— 拆出来的 children 也会被访问，嵌套标记同样能处理。
          return [SKIP, index];
        }
      },
    );
  };
}
