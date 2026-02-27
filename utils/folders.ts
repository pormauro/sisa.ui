import { Folder } from '@/contexts/FoldersContext';

export interface DisplayFolder extends Folder {
  level: number;
}

interface FolderNode extends Folder {
  children: FolderNode[];
}

const buildFolderTree = (folders: Folder[]): FolderNode[] => {
  const nodes = new Map<number, FolderNode>();

  folders.forEach(folder => {
    nodes.set(folder.id, { ...folder, children: [] });
  });

  const roots: FolderNode[] = [];

  folders.forEach(folder => {
    const node = nodes.get(folder.id);
    if (!node) {
      return;
    }

    if (folder.parent_id !== null && nodes.has(folder.parent_id)) {
      nodes.get(folder.parent_id)?.children.push(node);
      return;
    }

    roots.push(node);
  });

  return roots;
};

const flattenFolders = (nodes: FolderNode[], level = 0): DisplayFolder[] => {
  let result: DisplayFolder[] = [];

  nodes.forEach(node => {
    const { children, ...folderData } = node;
    result.push({ ...folderData, level });
    if (children.length > 0) {
      result = result.concat(flattenFolders(children, level + 1));
    }
  });

  return result;
};

export const getDisplayFolders = (folders: Folder[], clientId?: number | null): DisplayFolder[] => {
  const filteredFolders =
    typeof clientId === 'number' && Number.isFinite(clientId)
      ? folders.filter(folder => folder.client_id === clientId)
      : folders;

  return flattenFolders(buildFolderTree(filteredFolders));
};

export const getFolderIndentedName = (name: string, level: number): string => {
  if (level <= 0) {
    return name;
  }

  const indent = '│  '.repeat(Math.max(level - 1, 0));
  return `${indent}└─ ${name}`;
};
