import type { ImgHTMLAttributes } from 'react'

type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>

export function BrandLogo({ alt = 'Kache Envíos', ...props }: BrandLogoProps) {
  return <img src="/logo.png" alt={alt} {...props} />
}
