import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table"

describe("Table", () => {
  it("renders headers and rows", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Job A</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "Job A" })).toBeInTheDocument()
  })
})
