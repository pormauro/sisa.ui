import { Category } from '@/contexts/CategoriesContext';

export interface DisplayCategory extends Category {
  level: number;
}

interface CategoryNode extends Category {
  children: CategoryNode[];
}

const buildTree = (cats: Category[]): CategoryNode[] => {
  const nodes = new Map<number, CategoryNode>();

  cats.forEach(cat => {
    nodes.set(cat.id, { ...cat, children: [] });
  });

  const roots: CategoryNode[] = [];

  cats.forEach(cat => {
    const node = nodes.get(cat.id);
    if (!node) {
      return;
    }

    if (cat.parent_id !== null && nodes.has(cat.parent_id)) {
      const parent = nodes.get(cat.parent_id);
      parent?.children.push(node);
      return;
    }

    roots.push(node);
  });

  return roots;
};

const flatten = (nodes: CategoryNode[], level = 0): DisplayCategory[] => {
  let res: DisplayCategory[] = [];
  nodes.forEach(n => {
    const { children, ...rest } = n;
    res.push({ ...rest, level });
    if (children && children.length) {
      res = res.concat(flatten(children, level + 1));
    }
  });
  return res;
};

export const getDisplayCategories = (
  categories: Category[],
  filterType?: 'income' | 'expense'
): DisplayCategory[] => {
  const filtered = filterType ? categories.filter(c => c.type === filterType) : categories;
  const tree = buildTree(filtered);
  return flatten(tree);
};
