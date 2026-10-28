export interface AssetFolder {
  name: string;
  files: string[];
}

export interface AssetTree {
  folders: AssetFolder[];
}

export async function fetchAssetTree(): Promise<AssetTree> {
  const res = await fetch('/api/assets');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${res.status}`);
  }
  return res.json();
}

export async function fetchAssetContent(folder: string, file: string): Promise<string> {
  const res = await fetch(`/api/assets/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${res.status}`);
  }
  const { content } = await res.json();
  return content;
}

export async function saveAsset(
  folder: string,
  file: string,
  content: string
): Promise<void> {
  const res = await fetch(`/api/assets/${encodeURIComponent(folder)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, content }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${res.status}`);
  }
}

export async function renderAssetPreview(
  folder: string,
  file = 'generate.ts',
  size = 100
): Promise<void> {
  const res = await fetch(`/api/assets/${encodeURIComponent(folder)}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, size }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${res.status}`);
  }
}
