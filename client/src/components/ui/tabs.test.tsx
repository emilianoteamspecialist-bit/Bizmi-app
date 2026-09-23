import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"

describe("Tabs", () => {
  it("shows the default tab's content and switches on trigger click", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="agencies">Agencies</TabsTrigger>
        </TabsList>
        <TabsContent value="all">All content</TabsContent>
        <TabsContent value="agencies">Agencies content</TabsContent>
      </Tabs>
    )

    expect(screen.getByText("All content")).toBeInTheDocument()
    expect(screen.queryByText("Agencies content")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Agencies" }))

    expect(screen.getByText("Agencies content")).toBeInTheDocument()
    expect(screen.queryByText("All content")).not.toBeInTheDocument()
  })
})
