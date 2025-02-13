import { useEffect, useRef } from 'react'

export function PieChart({ data }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const total = data.reduce((sum, item) => sum + item.time, 0)
    let startAngle = 0

    // Clear existing paths
    svgRef.current.innerHTML = ''

    data.forEach((item, index) => {
      const percentage = item.time / total
      const endAngle = startAngle + (percentage * 360)
      
      const startRadians = (startAngle - 90) * Math.PI / 180
      const endRadians = (endAngle - 90) * Math.PI / 180
      
      const x1 = 60 + 48 * Math.cos(startRadians)
      const y1 = 60 + 48 * Math.sin(startRadians)
      const x2 = 60 + 48 * Math.cos(endRadians)
      const y2 = 60 + 48 * Math.sin(endRadians)
      
      const largeArc = percentage > 0.5 ? 1 : 0
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', `
        M 60 60
        L ${x1} ${y1}
        A 48 48 0 ${largeArc} 1 ${x2} ${y2}
        Z
      `)
      path.setAttribute('fill', `hsl(${(index * 360) / data.length}, 70%, 60%)`)
      path.setAttribute('stroke', 'var(--bgcolor2)')
      path.setAttribute('stroke-width', '1')
      
      // Add hover effect
      path.addEventListener('mouseenter', () => {
        path.style.transform = 'scale(1.05)'
        path.style.opacity = '1'
      })
      
      path.addEventListener('mouseleave', () => {
        path.style.transform = 'scale(1)'
        path.style.opacity = '0.8'
      })
      
      svgRef.current.appendChild(path)
      startAngle = endAngle
    })
  }, [data])

  return (
    <div id="pie">
      <svg ref={svgRef} viewBox="0 0 120 120" />
    </div>
  )
} 