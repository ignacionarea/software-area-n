import { Topbar } from "@/components/layout/topbar"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"

type Props = {
  title: string
  crumbs: string[]
  hint: string
}

export async function PlaceholderPage({ title, crumbs, hint }: Props) {
  const dolar = await getDolarVentaSafe()
  return (
    <>
      <Topbar crumbs={crumbs} title={title} dolar={dolar} />
      <div className="flex-1 grid place-items-center px-6 py-12">
        <div className="text-center max-w-md">
          <div className="text-sm font-medium mb-2">{title} · próximamente</div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
    </>
  )
}
