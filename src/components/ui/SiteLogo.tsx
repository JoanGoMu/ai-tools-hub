interface Props {
  className?: string;
  size?: number;
}

export default function SiteLogo({ className = '', size = 32 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Background circle */}
      <rect width="32" height="32" rx="8" fill="#4F46E5" />
      {/* Circuit/AI lines */}
      <circle cx="16" cy="16" r="5" fill="white" opacity="0.9" />
      <circle cx="16" cy="16" r="2.5" fill="#4F46E5" />
      {/* Nodes */}
      <circle cx="6" cy="10" r="2" fill="white" opacity="0.7" />
      <circle cx="26" cy="10" r="2" fill="white" opacity="0.7" />
      <circle cx="6" cy="22" r="2" fill="white" opacity="0.7" />
      <circle cx="26" cy="22" r="2" fill="white" opacity="0.7" />
      {/* Connecting lines */}
      <line x1="8" y1="10" x2="11.5" y2="13" stroke="white" strokeWidth="1.2" opacity="0.6" />
      <line x1="24" y1="10" x2="20.5" y2="13" stroke="white" strokeWidth="1.2" opacity="0.6" />
      <line x1="8" y1="22" x2="11.5" y2="19" stroke="white" strokeWidth="1.2" opacity="0.6" />
      <line x1="24" y1="22" x2="20.5" y2="19" stroke="white" strokeWidth="1.2" opacity="0.6" />
    </svg>
  );
}
