/* eslint-disable @next/next/no-head-element, @next/next/no-img-element */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type ChildrenProps = { children?: ReactNode; style?: CSSProperties };

export function Html({ children, lang }: ChildrenProps & { lang?: string }) {
  return <html lang={lang}>{children}</html>;
}

export function Head({ children }: { children?: ReactNode }) {
  return <head>{children}</head>;
}

export function Preview({ children }: { children?: ReactNode }) {
  return (
    <div style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>
      {children}
    </div>
  );
}

export function Body({ children, style }: ChildrenProps) {
  return <body style={style}>{children}</body>;
}

export function Container({ children, style }: ChildrenProps) {
  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
      <tbody>
        <tr>
          <td style={style}>{children}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function Section({ children, style }: ChildrenProps) {
  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
      <tbody>
        <tr>
          <td style={style}>{children}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function Row({ children, style }: ChildrenProps) {
  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
      <tbody>
        <tr style={style}>{children}</tr>
      </tbody>
    </table>
  );
}

export function Column({ children, style }: ChildrenProps) {
  return <td style={style}>{children}</td>;
}

export function Text({ children, style }: ChildrenProps) {
  return <p style={style}>{children}</p>;
}

export function Heading({
  children,
  style,
  as = "h1",
}: ChildrenProps & { as?: "h1" | "h2" | "h3" }) {
  const Tag = as;
  return <Tag style={style}>{children}</Tag>;
}

export function Hr({ style }: { style?: CSSProperties }) {
  return <hr style={style} />;
}

export function Img({
  src,
  alt,
  width,
  height,
  style,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
}) {
  return (
    <img src={src} alt={alt} width={width} height={height} style={style} />
  );
}

export function Button({
  children,
  href,
  style,
}: ChildrenProps & { href: string }) {
  return (
    <a href={href} style={style} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export type EmailHtmlProps = HTMLAttributes<HTMLElement>;
