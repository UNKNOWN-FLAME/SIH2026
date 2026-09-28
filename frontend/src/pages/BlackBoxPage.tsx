import { useNavigate } from 'react-router-dom'
import BlackBoxModal from '../components/blackbox/BlackBoxModal'
import DashboardPage from './DashboardPage'

export default function BlackBoxPage() {
  const navigate = useNavigate()

  return (
    <>
      <DashboardPage />
      <BlackBoxModal
        isOpen={true}
        isStandalonePage={true}
        onClose={() => navigate(-1)}
      />
    </>
  )
}
