import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  SelectGroup, SelectLabel, SelectSeparator, Label,
} from "eden-institute";

export function HerbPicker() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 320 }}>
      <Label className="font-serif">Choose a herb to study</Label>
      <Select defaultValue="chamomile">
        <SelectTrigger>
          <SelectValue placeholder="Select a herb…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="chamomile">Chamomile</SelectItem>
          <SelectItem value="tulsi">Tulsi (Holy Basil)</SelectItem>
          <SelectItem value="nettle">Nettle</SelectItem>
          <SelectItem value="elderberry">Elderberry</SelectItem>
          <SelectItem value="ashwagandha">Ashwagandha</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function GroupedActions() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 320 }}>
      <Label className="font-serif">Primary herbal action</Label>
      <Select defaultValue="nervine">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Calming</SelectLabel>
            <SelectItem value="nervine">Nervine</SelectItem>
            <SelectItem value="sedative">Sedative</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Digestive</SelectLabel>
            <SelectItem value="carminative">Carminative</SelectItem>
            <SelectItem value="bitter">Bitter</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export function Open() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 320, minHeight: 260 }}>
      <Label className="font-serif">Constitutional pattern</Label>
      <Select defaultValue="warm-damp" open>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hot-dry">Hot &amp; Dry</SelectItem>
          <SelectItem value="warm-damp">Warm &amp; Damp</SelectItem>
          <SelectItem value="cool-dry">Cool &amp; Dry</SelectItem>
          <SelectItem value="cold-damp">Cold &amp; Damp</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 320 }}>
      <Label className="font-serif">Practitioner formulary</Label>
      <Select defaultValue="locked" disabled>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="locked">Opens 2027</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
