const HERO_CANVAS_SIZE = 960
const HERO_OUTPUT_QUALITY = 0.9

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    image.src = source
  })
}

export async function createStartScreenHeroTexture(source: string): Promise<string> {
  try {
    const image = await loadImage(source)
    const canvas = document.createElement('canvas')
    canvas.width = HERO_CANVAS_SIZE
    canvas.height = HERO_CANVAS_SIZE

    const context = canvas.getContext('2d')
    if (!context) {
      return source
    }

    const sourceSquare = Math.min(image.width, image.height)
    const sourceX = (image.width - sourceSquare) / 2
    const sourceY = (image.height - sourceSquare) / 2

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSquare,
      sourceSquare,
      0,
      0,
      HERO_CANVAS_SIZE,
      HERO_CANVAS_SIZE
    )

    const highlightGradient = context.createRadialGradient(
      HERO_CANVAS_SIZE * 0.22,
      HERO_CANVAS_SIZE * 0.16,
      HERO_CANVAS_SIZE * 0.04,
      HERO_CANVAS_SIZE * 0.22,
      HERO_CANVAS_SIZE * 0.16,
      HERO_CANVAS_SIZE * 0.7
    )
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.18)')
    highlightGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)')
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = highlightGradient
    context.fillRect(0, 0, HERO_CANVAS_SIZE, HERO_CANVAS_SIZE)

    const shadeGradient = context.createLinearGradient(0, 0, 0, HERO_CANVAS_SIZE)
    shadeGradient.addColorStop(0, 'rgba(8, 18, 38, 0.04)')
    shadeGradient.addColorStop(0.58, 'rgba(8, 18, 38, 0.08)')
    shadeGradient.addColorStop(1, 'rgba(8, 18, 38, 0.26)')
    context.fillStyle = shadeGradient
    context.fillRect(0, 0, HERO_CANVAS_SIZE, HERO_CANVAS_SIZE)

    return canvas.toDataURL('image/jpeg', HERO_OUTPUT_QUALITY)
  } catch {
    return source
  }
}
