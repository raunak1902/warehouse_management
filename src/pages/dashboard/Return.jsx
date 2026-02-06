import { RotateCcw } from 'lucide-react'

const Return = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <RotateCcw className="w-8 h-8 text-primary-600" />
          Return
        </h1>
        <p className="text-gray-600 mt-1">Return module — content and use to be defined.</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">Placeholder for Return component.</p>
      </div>
    </div>
  )
}

export default Return
