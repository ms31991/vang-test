import SupportChat from "../components/SupportChat";
import { useLanguage } from "../i18n/LanguageContext";
import { usePageSeo } from "../seo/usePageSeo";

export default function Inbox() {
  const { t } = useLanguage();
  usePageSeo({
    title: `${t("navSupport")} | Vanguard`,
    description: t("chatLead"),
    path: "/inbox",
    noindex: true,
  });

  return <SupportChat />;
}
