import { createFileRoute } from '@tanstack/react-router'
import Looplance from '@/components/Looplance'

export const Route = createFileRoute('/')({
  component: () => <Looplance />,
})

