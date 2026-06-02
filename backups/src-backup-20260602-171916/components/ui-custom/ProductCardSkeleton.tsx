import { Skeleton } from '@/components/ui/skeleton'

export default function ProductCardSkeleton() {
  return (
    <div className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Image area */}
      <div className="aspect-square bg-gray-50 p-3">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>

      {/* Info area */}
      <div className="flex flex-col flex-1 p-4">
        {/* Title lines */}
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-3" />

        <div className="mt-auto space-y-0.5">
          {/* Compare price (strikethrough) */}
          <Skeleton className="h-3 w-2/3" />
          {/* Price */}
          <Skeleton className="h-6 w-1/2" />
          {/* Financing text */}
          <Skeleton className="h-3 w-3/4" />
        </div>

        {/* Button */}
        <Skeleton className="mt-3 h-10 w-full rounded-lg" />
      </div>
    </div>
  )
}
