import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)

    if (error) throw error

    return NextResponse.json({
      status: 'ok',
      supabase: 'connected',
    })
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}