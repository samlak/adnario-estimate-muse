export const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((each) => each !== item) : [...list, item]);

export const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
