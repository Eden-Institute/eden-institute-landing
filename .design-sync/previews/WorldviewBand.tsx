import { WorldviewBand } from "eden-institute";

export function Default() {
  return <WorldviewBand />;
}

export function WithHeadline() {
  return (
    <WorldviewBand
      caption="On the source of vital force"
      headline="Where life comes from"
    />
  );
}
