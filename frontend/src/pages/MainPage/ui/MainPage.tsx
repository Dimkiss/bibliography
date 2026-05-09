import { Header } from "@/widgets/Header";
import { Footer } from "@/widgets/Footer";
import { PublicationList } from "@/widgets/PublicationList";
import { AnalyticsPanel } from "@/widgets/AnalyticsPanel";
import { PublicationQuickSearchPanel } from "@/features/search-publications";


export function MainPage() {
  return (
    <div className="app-page">
      <Header title="Библиография ЛИН СО РАН" />

      <main className="app-main">
        <div className="container app-block-group">
          <PublicationQuickSearchPanel />
          <AnalyticsPanel />
          <PublicationList />
        </div>
      </main>
      <Footer />
    </div>
  );
}
