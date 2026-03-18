import { useState } from 'react'
import { Shield, AlertTriangle, XCircle, CheckCircle, AlertCircle } from 'lucide-react'

/**
 * AssignmentHealthCheck - Component for checking device/set health before assignment
 * Handles both component health (auto) and assignment readiness health (manual)
 */
const AssignmentHealthCheck = ({
  componentHealth,
  assignmentHealth,
  assignmentHealthNote,
  onAssignmentHealthChange,
  onAssignmentHealthNoteChange,
  required = true,
  disabled = false,
  isSet = false,
}) => {
  const healthOptions = [
    {
      value: 'good',
      label: 'Good Condition',
      icon: CheckCircle,
      description: 'Device is fully functional and ready for deployment',
      color: 'green',
      disabled: componentHealth === 'damage' || componentHealth === 'repair',
    },
    {
      value: 'needs_repair',
      label: 'Needs Repair',
      icon: AlertTriangle,
      description: 'Device needs maintenance before full deployment',
      color: 'amber',
      disabled: false,
    },
    {
      value: 'damaged',
      label: 'Damaged',
      icon: XCircle,
      description: 'Device has physical or functional damage',
      color: 'red',
      disabled: false,
    },
  ]

  const getComponentHealthInfo = () => {
    switch (componentHealth) {
      case 'ok':
        return {
          label: 'All Components Healthy',
          color: 'green',
          icon: CheckCircle,
          bgColor: 'bg-green-50',
          textColor: 'text-green-700',
          borderColor: 'border-green-200',
        }
      case 'repair':
        return {
          label: 'Component Needs Repair',
          color: 'amber',
          icon: AlertTriangle,
          bgColor: 'bg-amber-50',
          textColor: 'text-amber-700',
          borderColor: 'border-amber-200',
        }
      case 'damage':
        return {
          label: 'Component Damaged',
          color: 'red',
          icon: XCircle,
          bgColor: 'bg-red-50',
          textColor: 'text-red-700',
          borderColor: 'border-red-200',
        }
      default:
        return {
          label: 'Unknown',
          color: 'gray',
          icon: AlertCircle,
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200',
        }
    }
  }

  const componentInfo = getComponentHealthInfo()
  const ComponentIcon = componentInfo.icon

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gray-700 font-medium mb-3">
        <Shield className="w-5 h-5 text-primary-600" />
        <span>Health Check {required && <span className="text-red-500">*</span>}</span>
      </div>

      {/* Component Health (Read-only) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Component Health Status
        </label>
        <div className={`${componentInfo.bgColor} ${componentInfo.borderColor} border rounded-lg p-3`}>
          <div className="flex items-center gap-2">
            <ComponentIcon className={`w-5 h-5 ${componentInfo.textColor}`} />
            <div>
              <p className={`font-medium ${componentInfo.textColor}`}>
                {componentInfo.label}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {isSet 
                  ? 'Auto-calculated from individual device components' 
                  : 'Based on hardware condition'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Readiness Health (Manual Selection) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Assignment Readiness {required && <span className="text-red-500">*</span>}
        </label>
        <p className="text-xs text-gray-600 mb-3">
          Assess overall readiness including software, installations, and deployment preparedness
        </p>

        <div className="grid gap-3">
          {healthOptions.map((option) => {
            const Icon = option.icon
            const isSelected = assignmentHealth === option.value
            const isDisabled = disabled || option.disabled

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => !isDisabled && onAssignmentHealthChange(option.value)}
                disabled={isDisabled}
                className={`
                  relative p-4 border-2 rounded-lg text-left transition-all
                  ${isSelected 
                    ? `border-${option.color}-500 bg-${option.color}-50` 
                    : 'border-gray-200 bg-white hover:border-gray-300'}
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    p-2 rounded-lg flex-shrink-0
                    ${isSelected ? `bg-${option.color}-100` : 'bg-gray-100'}
                  `}>
                    <Icon className={`w-5 h-5 ${
                      isSelected ? `text-${option.color}-600` : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${
                        isSelected ? `text-${option.color}-900` : 'text-gray-900'
                      }`}>
                        {option.label}
                      </p>
                      {isSelected && (
                        <div className={`w-2 h-2 rounded-full bg-${option.color}-500`}></div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {option.description}
                    </p>
                    {isDisabled && option.value === 'good' && (
                      <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Cannot mark as "Good" when component health is not OK
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Note field (mandatory if not Good Condition) */}
      {assignmentHealth && assignmentHealth !== 'good' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Health Note <span className="text-red-500">*</span>
          </label>
          <textarea
            value={assignmentHealthNote || ''}
            onChange={(e) => onAssignmentHealthNoteChange(e.target.value)}
            disabled={disabled}
            required
            rows={3}
            placeholder="Describe the issues that need attention..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
          />
          <p className="text-xs text-gray-500 mt-1">
            Explain what repairs or attention is needed before full deployment
          </p>
        </div>
      )}

      {/* Informational banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-900">
            <p className="font-medium">Understanding Health Status</p>
            <ul className="mt-1 space-y-1 text-blue-700">
              <li>• <strong>Component Health:</strong> Physical hardware condition (auto-tracked)</li>
              <li>• <strong>Assignment Readiness:</strong> Overall deployment readiness including software, configs, etc.</li>
              <li>• A device with healthy components may still need repair for deployment readiness</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssignmentHealthCheck