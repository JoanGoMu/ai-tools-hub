interface Props {
  url: string;
  name: string;
  size?: number;
}

export default function ToolLogo({ url, name, size = 24 }: Props) {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
      alt={`${name} logo`}
      width={size}
      height={size}
      className="rounded-sm shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
