import { SettingsPage } from "../SettingsUI";
import { DomainsSettingsBody } from "./DomainsSettingsBody";

export default function DomainsPage() {
  return (
    <SettingsPage
      title="Domains"
      description="Connect a domain the client already owns by proving control of it."
    >
      <DomainsSettingsBody />
    </SettingsPage>
  );
}
