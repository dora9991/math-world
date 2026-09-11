export default function Title({ nav }) {
  return (
    <div className="mw-center" onClick={() => nav.go("menu", {}, { replace: true })}>
      <div className="mw-title">math world</div>
      <div className="mw-sub">タップしてはじめる</div>
    </div>
  );
}
