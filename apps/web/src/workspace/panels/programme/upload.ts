export function upload(start: (kind: 'programme', body?: FormData) => void, files: FileList | null) {
  const file = files?.[0];
  if (!file) return;
  const body = new FormData();
  body.append('file', file);
  start('programme', body);
}
