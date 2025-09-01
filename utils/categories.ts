import { Category } from '@/contexts/CategoriesContext';

export interface DisplayCategory extends Category {
  level: number;
}

interface CategoryNode extends Category {
  children: CategoryNode[];
}

const buildTree = (cats: Category[], parentId: number | null = null): CategoryNode[] =>
  cats
    .filter(c => c.parent_id === parentId)
    .map(c => ({ ...c, children: buildTree(cats, c.id) }));

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
