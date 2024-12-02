import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  try {
    console.log('PUT /api/profile - Starting...')
    const { data: { user } } = await supabase.auth.getUser()
    console.log('Current user:', user?.id)

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const requestData = await request.json()
    console.log('Received profile update data:', requestData)

    // First, get the current profile
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    console.log('Current profile before update:', currentProfile)

    if (fetchError) {
      console.error('Error fetching current profile:', fetchError)
      return new NextResponse('Failed to fetch current profile', { status: 500 })
    }

    // Perform the update
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        first_name: requestData.first_name || currentProfile.first_name,
        last_name: requestData.last_name || currentProfile.last_name,
        business_name: requestData.business_name || currentProfile.business_name,
        business_type: requestData.business_type || currentProfile.business_type,
        business_url: requestData.business_url || currentProfile.business_url,
        support_email: requestData.support_email || currentProfile.support_email,
        support_phone: requestData.support_phone || currentProfile.support_phone,
        address_line1: requestData.address_line1 || currentProfile.address_line1,
        address_line2: requestData.address_line2 || currentProfile.address_line2,
        address_city: requestData.address_city || currentProfile.address_city,
        address_state: requestData.address_state || currentProfile.address_state,
        address_postal_code: requestData.address_postal_code || currentProfile.address_postal_code,
        address_country: requestData.address_country || currentProfile.address_country,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()

    console.log('Update operation result:', { updatedProfile, updateError })

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return new NextResponse('Failed to update profile', { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Profile updated successfully',
      profile: updatedProfile[0]
    })
  } catch (err) {
    console.error('Error in profile update:', err)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  try {
    console.log('POST /api/profile - Starting...')
    const { data: { user } } = await supabase.auth.getUser()
    console.log('Current user:', user?.id)

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Create initial profile
    const { data: profile, error: createError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating profile:', createError)
      return new NextResponse('Failed to create profile', { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Profile created successfully',
      profile
    })
  } catch (err) {
    console.error('Error in profile creation:', err)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function GET(request: Request) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Use a join to get profile data with email from auth.users
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        *,
        user:auth.users!profiles_id_fkey (
          email
        )
      `)
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return new NextResponse('Failed to fetch profile', { status: 500 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error in GET /api/profile:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}