import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// POST - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, recipient, type, status, relatedTransactionId } = body;

    console.log('📝 Creating notification:', { message: message?.substring(0, 50), recipient, type, status, relatedTransactionId });

    // Validate required fields
    if (!message || !recipient || !type || !status) {
      console.error('❌ Missing required fields:', { message: !!message, recipient: !!recipient, type: !!type, status: !!status });
      return NextResponse.json(
        { error: "Missing required fields: message, recipient, type, status" },
        { status: 400 }
      );
    }

    // Validate status enum
    const validStatuses = ["seen", "unseen"];
    if (!validStatuses.includes(status)) {
      console.error('❌ Invalid status:', status);
      return NextResponse.json(
        { error: "Invalid status. Must be 'seen' or 'unseen'" },
        { status: 400 }
      );
    }

    // If relatedTransactionId is provided, check if a notification already exists for this transaction
    if (relatedTransactionId) {
      const existingNotification = await prisma.notification.findFirst({
        where: { relatedTransactionId }
      });
      
      if (existingNotification) {
        console.log('⚠️ Notification already exists for transaction:', relatedTransactionId);
        // Return existing notification instead of creating duplicate
        return NextResponse.json(existingNotification, { status: 200 });
      }
    }

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        message,
        recipient,
        type,
        status,
        relatedTransactionId: relatedTransactionId || null,
      },
    });

    console.log('✅ Notification created:', notification.id, 'with transactionId:', relatedTransactionId);
    return NextResponse.json(notification, { status: 201 });
  } catch (error: any) {
    console.error("❌ Error creating notification:", error);
    return NextResponse.json(
      { error: "Failed to create notification", details: error.message },
      { status: 500 }
    );
  }
}

// GET - Retrieve notifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recipient = searchParams.get("recipient");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const limit = searchParams.get("limit");

    // Build where clause
    const where: any = {};
    if (recipient) where.recipient = recipient;
    if (status) where.status = status;
    if (type) where.type = type;

    // Build query options
    const queryOptions: any = {
      where,
      orderBy: { createdAt: "desc" },
      include: {
        relatedTransaction: true, // Include transaction details if needed
      },
    };

    if (limit) {
      queryOptions.take = parseInt(limit);
    }

    const notifications = await prisma.notification.findMany(queryOptions);

    return NextResponse.json(notifications, { status: 200 });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// PUT - Update notification status (e.g., mark as seen)
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get("id");
    const body = await request.json();
    const { status } = body;

    if (!notificationId) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Validate status enum
    const validStatuses = ["seen", "unseen"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'seen' or 'unseen'" },
        { status: 400 }
      );
    }

    // Update notification
    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: { status },
    });

    return NextResponse.json(updatedNotification, { status: 200 });
  } catch (error: any) {
    console.error("Error updating notification:", error);
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a notification
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get("id");

    if (!notificationId) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 }
      );
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    return NextResponse.json(
      { message: "Notification deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting notification:", error);
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}