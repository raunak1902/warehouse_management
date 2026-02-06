import { MapPin } from 'lucide-react'

const Location = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="w-8 h-8 text-primary-600" />
          Location
        </h1>
        <p className="text-gray-600 mt-1">Location module — content and use to be defined.</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">Placeholder for Location component.</p>
      </div>
    </div>
  )
}

export default Location
