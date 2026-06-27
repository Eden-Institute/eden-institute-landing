import {
  Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem,
  MenubarSeparator, MenubarLabel, MenubarShortcut, MenubarCheckboxItem,
} from "eden-institute";

export function ApothecaryBar() {
  return (
    <Menubar className="font-body">
      <MenubarMenu>
        <MenubarTrigger>Apothecary</MenubarTrigger>
        <MenubarContent>
          <MenubarLabel className="font-serif">Browse</MenubarLabel>
          <MenubarItem>All herbs</MenubarItem>
          <MenubarItem>By energetic pattern</MenubarItem>
          <MenubarItem>By body system</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            New monograph <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Materia Medica</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Actions</MenubarItem>
          <MenubarItem>Energetics</MenubarItem>
          <MenubarItem>Cautions</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Tier</MenubarTrigger>
        <MenubarContent>
          <MenubarLabel className="font-serif">Apothecary tier</MenubarLabel>
          <MenubarCheckboxItem checked>Free · Seedling</MenubarCheckboxItem>
          <MenubarCheckboxItem>Root</MenubarCheckboxItem>
          <MenubarCheckboxItem>Practitioner</MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}

export function QuizBar() {
  return (
    <Menubar className="font-body">
      <MenubarMenu>
        <MenubarTrigger>Pattern of Eden</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Take the quiz</MenubarItem>
          <MenubarItem>My body pattern</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Retake assessment</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Garden</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Saved herbs</MenubarItem>
          <MenubarItem>Formularies</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Account</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Profile</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Sign out <MenubarShortcut>⇧⌘Q</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
