import EduvhibeShell from "./EduvhibeShell";
import { UserProvider } from "./UserContext";

export default function EduvhibePage() {
  return (
    <UserProvider>
      <EduvhibeShell />
    </UserProvider>
  );
}
