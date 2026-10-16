/** 글 속의 https:// 주소를 눌러서 열 수 있는 링크로 바꿔 줍니다. */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer">
            {decodeURIComponentSafe(p)}
          </a>
        ) : (
          p
        ),
      )}
    </>
  );
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
